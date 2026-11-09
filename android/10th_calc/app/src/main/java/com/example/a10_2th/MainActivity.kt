package com.example.a10_2th

import android.os.Bundle
import android.widget.Button
import android.widget.TextView
import androidx.activity.enableEdgeToEdge
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat

class MainActivity : AppCompatActivity() {

    private lateinit var txtResult: TextView

    private var firstNumber = 0.0
    private var operator = ""
    private var newNumber = true

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContentView(R.layout.activity_main)
        ViewCompat.setOnApplyWindowInsetsListener(findViewById(R.id.main)) { v, insets ->
            val systemBars = insets.getInsets(WindowInsetsCompat.Type.systemBars())
            v.setPadding(systemBars.left, systemBars.top, systemBars.right, systemBars.bottom)
            insets
        }

        txtResult = findViewById(R.id.txtResult)

        // 숫자 버튼
        val numberIds = listOf(
            R.id.btn0, R.id.btn1, R.id.btn2,
            R.id.btn3, R.id.btn4, R.id.btn5,
            R.id.btn6, R.id.btn7, R.id.btn8,
            R.id.btn9
        )

        for (id in numberIds) {
            findViewById<Button>(id).setOnClickListener {
                val number = (it as Button).text.toString()

                if (newNumber) {
                    txtResult.text = number
                    newNumber = false
                } else {
                    txtResult.append(number)
                }
            }
        }

        val operators = mapOf(
            R.id.btnPlus to "+",
            R.id.btnMinus to "-",
            R.id.btnMultiply to "×",
            R.id.btnDivide to "/"
        )

        for ((id, op) in operators) {
            findViewById<Button>(id).setOnClickListener {
                firstNumber = txtResult.text.toString().toDoubleOrNull() ?: 0.0
                operator = op
                newNumber = true
            }
        }

        findViewById<Button>(R.id.btnClear).setOnClickListener {
            txtResult.text = "0"
            firstNumber = 0.0
            operator = ""
            newNumber = true
        }


    }
}